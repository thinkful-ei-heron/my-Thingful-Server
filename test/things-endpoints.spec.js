const knex = require('knex')
const app = require('../src/app')
const helpers = require('./test-helpers')

describe('Things Endpoints', function() {
  let db

  const {
    testUsers,
    testThings,
    testReviews,
  } = helpers.makeThingsFixtures()

  function makeAuthHeader(user){
    const token = Buffer.from(`${user.user_name}:${user.password}`).toString('base64');
    return `Basic ${token}`;
  }

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())
  before('cleanup', () => helpers.cleanTables(db))
  afterEach('cleanup', () => helpers.cleanTables(db))
  
  describe(`Protected Endpoints`, () => {

    

    const protectedEndpoints = [
      {
        name: 'GET /api/things/:thing_id',
        path: '/api/things/1'
      },
      {
        name: 'GET /api/things/:thing_id/reviews',
        path: '/api/things/1/reviews'
      },
    ]

    protectedEndpoints.forEach(endpoint => {
      
    describe(endpoint.name, () => {

      context(`Given no things`, () => {
        beforeEach('insert users not things', () => {
          return helpers.seedUsers(db, testUsers);
        })

        it(`responds with 404`, () => {
          const thingId = 12346;
          return supertest(app)
            .get(`/api/things/${thingId}`)
            .set('Authorization', makeAuthHeader(testUsers[0]))
            .expect(404, { error: `Thing doesn't exist` })
        })
      });
  
      context('Given there are things in the database', () => {

        beforeEach(`Insert things`, () => 
        helpers.seedThingsTables(
          db,
          testUsers,
          testThings
        )
      );
      // beforeEach('Insert Users', () => {
      //   helpers.seedUsers(
      //     db, 
      //     testUsers
      //   )
      // })
        it(`responds with 401 'Missing basic token' when no basic token`, () => {
          return supertest(app)
            .get(endpoint.path)
            .expect(401, { error: `Missing basic token`});
        });
        it(`responds 401 'Unauthorized request' when no credentials in token`, () => {
          const userNoCreds = { user_name: '', password: '' }
          return supertest(app)
            .get(`/api/things/1`)
            .set('Authorization', makeAuthHeader(userNoCreds))
            .expect(401, { error: `Unauthorized request.`})
          })

        it(`responds 401 'Unauthorized request' when invalid user`, () => {
          const userInvalidCreds = { user_name: 'user-not', password: 'password' }
            return supertest(app)
              .get(endpoint.path)
              .set('Authorization', makeAuthHeader(userInvalidCreds))
              .expect(401, { error: `Unauthorized request` })
            })

          it(`responds 401 'Unauthorized request' when invalid password`, () => {
            const userInvalidCreds = { user_name: 'dunder', password: 'wrong wrong wrong' }
              return supertest(app)
                .get(endpoint.path)
                .set('Authorization', makeAuthHeader(userInvalidCreds))
                .expect(401, { error: `Unauthorized request` })
              })

        it('responds with 200 and the specified thing', () => {
          const thingId = 2
          const expectedThing = helpers.makeExpectedThing(
            testUsers,
            testThings[thingId - 1],
            testReviews
          )
  
          return supertest(app)
            .get(`/api/things/${thingId}`)
            .set('Authorization', makeAuthHeader(testUsers[0]))
            .expect(200, expectedThing)
        })
      })
  
      context(`Given an XSS attack thing`, () => {
        const testUser = helpers.makeUsersArray()[1];
        console.log('125', testUser);
        const {
          maliciousThing,
          expectedThing,
        } = helpers.makeMaliciousThing(testUser)
  
        beforeEach('insert malicious thing', () => {
          return helpers.seedMaliciousThing(
            db,
            testUser,
            maliciousThing
          )
        })
  
        it('removes XSS attack content', () => {
          return supertest(app)
            .get(`/api/things/${maliciousThing.id}`)
            .set('Authorization', makeAuthHeader(testUsers[1]))
            .expect(200)
            .expect(res => {
              expect(res.body.title).to.eql(expectedThing.title)
              expect(res.body.content).to.eql(expectedThing.content)
            })
        })
      })
    })
  
    describe(`GET /api/things/:thing_id/reviews`, () => {


      context(`Given no things`, () => {
        beforeEach('insert users not things', () => {
          return helpers.seedUsers(db, testUsers);
        })
        it(`responds with 404`, () => {
          const thingId = 123456
          return supertest(app)
            .get(`/api/things/${thingId}/reviews`)
            .set('Authorization', makeAuthHeader(testUsers[0]))
            .expect(404, { error: `Thing doesn't exist` })
        })
      })
  
      context('Given there are reviews for thing in the database', () => {
        beforeEach('insert things, users, and reviews', () =>{
          return helpers.seedThingsTables(
            db,
            testUsers,
            testThings,
            testReviews)
        })

        it('responds with 200 and the specified reviews', () => {
          const thingId = 1
          const expectedReviews = helpers.makeExpectedThingReviews(
            testUsers, thingId, testReviews
          )

          return supertest(app)
            .get(`/api/things/${thingId}/reviews`)
            .set('Authorization', makeAuthHeader(testUsers[1]))
            .expect(200)
            .then(response =>{
              expect(response.body, expectedReviews)
            })
        })
      })
    })
  })
})

  describe(`GET /api/things`, () => {
    context(`Given no things`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/things')
          .expect(200, [])
      })
    })

    context('Given there are things in the database', () => {
      beforeEach('insert things', () =>
        helpers.seedThingsTables(
          db,
          testUsers,
          testThings,
          testReviews,
        )
      )

      it('responds with 200 and all of the things', () => {
        const expectedThings = testThings.map(thing =>
          helpers.makeExpectedThing(
            testUsers,
            thing,
            testReviews,
          )
        )
        return supertest(app)
          .get('/api/things')
          .expect(200, expectedThings)
      })
    })

    context(`Given an XSS attack thing`, () => {
      const testUser = helpers.makeUsersArray()[1]
      const {
        maliciousThing,
        expectedThing,
      } = helpers.makeMaliciousThing(testUser)

      beforeEach('insert malicious thing', () => {
        return helpers.seedMaliciousThing(
          db,
          testUser,
          maliciousThing,
        )
      })

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/things`)
          .expect(200)
          .expect(res => {
            expect(res.body[0].title).to.eql(expectedThing.title)
            expect(res.body[0].content).to.eql(expectedThing.content)
          })
      })
    })
  })
})
