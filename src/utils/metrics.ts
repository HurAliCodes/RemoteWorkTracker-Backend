/**
 * Lightweight in-process Prometheus-style metrics (text exposition).
 * No external dependency — enough for SLO dashboards and /metrics scrapes.
 */

type Counter = { name: string; help: string; labels: Map<string, number> };
type Histogram = { name: string; help: string; buckets: number[]; counts: Map<string, number[]>; sums: Map<string, number> };

const counters = new Map<string, Counter>();
const histograms = new Map<string, Histogram>();

function labelKey(labels?: Record<string, string>) {
	if (!labels) return '';
	return Object.keys(labels)
		.sort()
		.map((k) => `${k}=${labels[k]}`)
		.join(',');
}

export function incCounter(name: string, help: string, labels?: Record<string, string>, by = 1) {
	let c = counters.get(name);
	if (!c) {
		c = { name, help, labels: new Map() };
		counters.set(name, c);
	}
	const key = labelKey(labels);
	c.labels.set(key, (c.labels.get(key) || 0) + by);
}

export function observeHistogram(
	name: string,
	help: string,
	valueMs: number,
	labels?: Record<string, string>,
	buckets = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]
) {
	let h = histograms.get(name);
	if (!h) {
		h = { name, help, buckets, counts: new Map(), sums: new Map() };
		histograms.set(name, h);
	}
	const key = labelKey(labels);
	let arr = h.counts.get(key);
	if (!arr) {
		arr = new Array(buckets.length + 1).fill(0);
		h.counts.set(key, arr);
	}
	let placed = false;
	for (let i = 0; i < buckets.length; i++) {
		if (valueMs <= buckets[i]) {
			arr[i] += 1;
			placed = true;
			break;
		}
	}
	if (!placed) arr[buckets.length] += 1;
	h.sums.set(key, (h.sums.get(key) || 0) + valueMs);
}

export function renderPrometheusMetrics(): string {
	const lines: string[] = [];
	for (const c of counters.values()) {
		lines.push(`# HELP ${c.name} ${c.help}`);
		lines.push(`# TYPE ${c.name} counter`);
		for (const [lk, val] of c.labels) {
			if (!lk) lines.push(`${c.name} ${val}`);
			else {
				const parts = lk.split(',').map((p) => {
					const [k, v] = p.split('=');
					return `${k}="${v}"`;
				});
				lines.push(`${c.name}{${parts.join(',')}} ${val}`);
			}
		}
	}
	for (const h of histograms.values()) {
		lines.push(`# HELP ${h.name} ${h.help}`);
		lines.push(`# TYPE ${h.name} histogram`);
		for (const [lk, arr] of h.counts) {
			const labelPrefix = lk
				? lk
						.split(',')
						.map((p) => {
							const [k, v] = p.split('=');
							return `${k}="${v}"`;
						})
						.join(',')
				: '';
			let cumulative = 0;
			for (let i = 0; i < h.buckets.length; i++) {
				cumulative += arr[i];
				const le = h.buckets[i];
				const extra = labelPrefix ? `${labelPrefix},le="${le}"` : `le="${le}"`;
				lines.push(`${h.name}_bucket{${extra}} ${cumulative}`);
			}
			cumulative += arr[h.buckets.length];
			const extraInf = labelPrefix ? `${labelPrefix},le="+Inf"` : `le="+Inf"`;
			lines.push(`${h.name}_bucket{${extraInf}} ${cumulative}`);
			const sumLabels = labelPrefix ? `{${labelPrefix}}` : '';
			lines.push(`${h.name}_sum${sumLabels} ${h.sums.get(lk) || 0}`);
			lines.push(`${h.name}_count${sumLabels} ${cumulative}`);
		}
	}
	return lines.join('\n') + '\n';
}

/** Documented SLOs for operators (also returned from /health/ready meta). */
export const AI_SLOS = {
	aiHttpSuccessRate: '>= 99% over 24h',
	aiHttpP95LatencyMs: '<= 5000',
	reportFreshnessHours: '<= 36 for active users',
	dlqRatePerHour: '<= 5',
};
