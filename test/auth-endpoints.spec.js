/* eslint-disable quotes */
const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');
const jwt = require('jsonwebtoken');

describe(`Auth Endpoints`, () => {
    let db;

    const { testUsers } = helpers.makeThingsFixtures();
    const testUser = testUsers[0];

    before('make Knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        });
        app.set('db', db);
    });

    after('disconnect from db', () => db.destroy());
    before('cleanup', () => helpers.cleanTables(db));
    afterEach('cleanup', () => helpers.cleanTables(db));

    describe('POST /api/auth/login', () => {
        beforeEach('insert users', () => 
            helpers.seedUsers(
                db,
                testUsers
            )
        );

        const requiredFields = ['user_name', 'password'];

        requiredFields.forEach(field => {
            const loginAttemptBody = {
                user_name: testUser.user_name,
                password: testUser.password
            };

            it(`responds with 400 required error when ${field} is missing`, () =>{
                delete loginAttemptBody[field];

                return supertest(app)
                    .post('/api/auth/login')
                    .send(loginAttemptBody)
                    .expect(400, {
                        error: `Missing ${field} in request body`,
                    });
            });
        });

        it(`responds with 400 'invalid user_name or password' when bad user_name`, () => {
            const userInvalidUser = { user_name: 'badUserName', password: 'existy' };
            return supertest(app)
                .post('/api/auth/login')
                .send(userInvalidUser)
                .expect(400, { error:  'Incorrect user_name or password'});
        });

        it(`responds with 400 'invalid user_name or password' when bad password`, () => {
            const userInvalidPassword = { user_name: testUser.user_name, password: '123 not it'};

            return supertest(app)
                .post('/api/auth/login')
                .send(userInvalidPassword)
                .expect(400, { error: `Incorrect user_name or password`});
        });

        it('responds with 200 and JWT auth token with secret when valid credentials', () => {
            const userValidCreds = { 
                user_name: testUser.user_name,
                password: testUser.password
            };
            const expectedToken = jwt.sign(
                { user_id: testUser.id },
                process.env.JWT_SECRET,
                {
                    subject: testUser.user_name,
                    algorithm: 'HS256'
                }
            );
                return supertest(app)
                    .post('/api/auth/login')
                    .send(userValidCreds)
                    .expect(200, {
                        authToken: expectedToken
                    });
        });
    });
});