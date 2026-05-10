import request from 'supertest';
import app from '../../app';

describe('Role API', () => {
  let createdRoleId: string;
  const baseUrl = '/api/v1/roles';

  it('should create a new role', async () => {
    const res = await request(app)
      .post(baseUrl)
      .send({ name: 'TestRole', description: 'A test role' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('roleId');
    createdRoleId = res.body.data.roleId;
  });

  it('should get the created role by id', async () => {
    const res = await request(app).get(`${baseUrl}/${createdRoleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('role_id', createdRoleId);
  });

  it('should update the role', async () => {
    const res = await request(app)
      .patch(`${baseUrl}/${createdRoleId}`)
      .send({ name: 'UpdatedRole', description: 'Updated desc' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('name', 'UpdatedRole');
  });

  it('should delete the role', async () => {
    const res = await request(app).delete(`${baseUrl}/${createdRoleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('message');
  });

  it('should return 404 for deleted role', async () => {
    const res = await request(app).get(`${baseUrl}/${createdRoleId}`);
    expect(res.status).toBe(404);
  });
});
