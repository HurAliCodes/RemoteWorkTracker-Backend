import migrateIdleLogs from './migrate-idle_logs';

migrateIdleLogs()
  .then(() => {
    console.log('migrate-idle_logs done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
