const OrdersDataSource = require('./app')

const seeder = new OrdersDataSource();

seeder.createTables()
  .then(() => {
    console.log('Tables created');
  })
  .catch((err) => {
    console.error('Error creating tables', err);
  });

  seeder.seedOrders(20)
  .then(() => {
    console.log('Orders seeded');
  })
  .catch((err) => {
    console.error('Error seeding orders', err);
  });

