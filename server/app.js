const { ApolloServer, gql } = require('apollo-server');
const sqlite3 = require('sqlite3').verbose();
const { faker } = require('@faker-js/faker');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./database.db', err => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the orders database.');
});

class OrdersDataSource {
  async getAllOrders() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM orders', [], (err, rows) => {
        if (err) {
          reject(err);
        }
        const orders = rows.map(row => {
          row.items = JSON.parse(row.items);
          return row;
        })
        resolve(orders);
      });
    });
  }

  async getOrdersByStatus(status) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM orders WHERE status = ?', [status], (err, rows) => {
        if (err) {
          reject(err);
        }
        const orders = rows.map(row => {
          row.items = JSON.parse(row.items);
          return row;
        })
        resolve(rows);
      });
    });
  }

  async getOrderById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        }
        if(row) {
          row.items = JSON.parse(row.items);
        }
        resolve(row);
      });
    });
  }

  async getOrderItems(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        }
        resolve(row);
      });
    });
  }

  async insertOrder(order) {
    return new Promise((resolve, reject) => {
      const { deliveryAddress, items, total, discountCode, comment, status } = order;
  
      const sql = `INSERT INTO orders (id, deliveryAddress, items, total, discountCode, comment, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
      const values = [
        order.id,
        deliveryAddress,
        JSON.stringify(items),
        total,
        discountCode,
        comment,
        status,
      ];
  
      db.run(sql, values, function (err) {
        if (err) {
          reject(err);
        }
  
        db.get(`SELECT * FROM orders WHERE id = ?`, [order.id], (err, row) => {
          if (err) {
            reject(err);
          }
  
          resolve(row);
        });
      });
    });
  }
  

  async updateOrderStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function(err) {
        if (err) {
          reject(err);
        }
        db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
          if (err) {
            reject(err);
          }
          if(row) {
            row.items = JSON.parse(row.items);
          }
          resolve(row);
        });
      });
    });
  }

  async deleteOrderById(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        }
        resolve(this.changes > 0);
      });
    });
  }
  
  async seedOrders(count) {
    const rowsCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) AS count FROM orders', (err, row) => {
          if (err) {
            reject(err);
          }
          resolve(row.count);
        });
      });
    
    rowsCount > 0 ? console.log('Database already seeded. Skipping.') : this.seedOrders(20);

    for (let i = 0; i < count; i++) {
      const order = {
        id: uuidv4(),
        deliveryAddress: faker.address.streetAddress(true),
        items: [
          faker.commerce.product(),
          faker.commerce.product(),
          faker.commerce.product(),
        ],
        total: parseFloat(faker.commerce.price()),
        discountCode: faker.random.alpha({ count: 5, casing: 'upper' }),
        comment: faker.lorem.sentence(5),
        status: faker.helpers.arrayElement([
          'PENDING',
          'PAID',
          'IN_PROGRESS',
          'IN_DELIVERY',
          'DELIVERED',
        ]),
      };
  
      const { deliveryAddress, items, total, discountCode, comment, status } = order;
  
      const insertedOrder = await new Promise((resolve, reject) => {
        const sql = `INSERT INTO orders (id, deliveryAddress, items, total, discountCode, comment, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [        order.id,        deliveryAddress,        JSON.stringify(items),        total,        discountCode,        comment,        status,      ];
  
        db.run(sql, values, function (err) {
          if (err) {
            reject(err);
          }
  
          db.get(`SELECT * FROM orders WHERE id = ?`, [order.id], (err, row) => {
            if (err) {
              reject(err);
            }
  
            resolve(row);
          });
        });
      });
  
      console.log(`Inserted order with id ${insertedOrder.id}`);
    }
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          deliveryAddress TEXT,
          items TEXT,
          total REAL,
          discountCode TEXT,
          comment TEXT,
          status TEXT
        )`,
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }
  

  
}

class OffersDataSource {
  async getAllOffers() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM offers', [], (err, rows) => {
        if (err) {
          reject(err);
        }
        resolve(rows);
      });
    });
  }
}

const typeDefs = gql`
  enum OrderStatus {
    PENDING
    PAID
    IN_PROGRESS
    IN_DELIVERY
    DELIVERED
  }

  type Order {
    id: ID!
    deliveryAddress: String!
    items: [String!]!
    total: Float!
    discountCode: String
    comment: String
    status: OrderStatus!
  }

  scalar Item

  type Query {
    orders(status: OrderStatus): [Order!]!
    order(id: ID!): Order
  }

  type Mutation {
    createOrder(
      deliveryAddress: String!,
      items: [String!]!,
      total: Float!,
      discountCode: String,
      comment: String,
      status: OrderStatus!
      ): Order
    updateStatus(id: ID!, status: OrderStatus!): Order
    deleteOrder(id: ID!): Boolean
  }
`;

const resolvers = {
  Item: {
    serialize: items => JSON.parse(items),
    parseValue: items => JSON.stringify(items),
    parseLiteral: ast => JSON.parse(ast.value),
  },
  Query: {
    orders: (_, { status }, { dataSources }) => {
      return status ? dataSources.orders.getOrdersByStatus(status) : dataSources.orders.getAllOrders();
    },
    order: (_, { id }, { dataSources }) => {
      return dataSources.orders.getOrderById(id);
    },
  },
  Mutation: {
    createOrder: async (_, { deliveryAddress, items, total, discountCode, comment, status }, { dataSources }) => {
      const order = {
        id: uuidv4(),
        deliveryAddress,
        items,
        total,
        discountCode,
        comment,
        status,
      };

      const { id } = await dataSources.orders.insertOrder(order);

      return { id, deliveryAddress, items, total, discountCode, comment, status };
    },
    updateStatus: async (_, { id, status }, { dataSources }) => {
      const order = dataSources.orders.updateOrderStatus(id, status);
      return order;
    },
    deleteOrder: async (_, { id }, { dataSources }) => {
      return dataSources.orders.deleteOrderById(id);
    }
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    orders: new OrdersDataSource(),
  }),
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});

module.exports = OrdersDataSource;