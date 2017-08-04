const request = require('request');

const migrationCtrl = {};

function saveAccount(db, account) {
  return new Promise((resolve, reject) => {
    console.log('accountdata before save in save account: ', account);
    if (!account.storeName || !account.token) {
      console.log('account data not valid');
      reject(new Error('account data not valid'));
    } else {
      db.collection('accounts').insertOne(account, (err) => {
        if (err) {
          console.log('error migrating account data');
          reject(err);
        } else {
          console.log('account in success of save account', account);
          resolve(account);
        }
      });
    }
  });
}

const getProducts = (account) => {
  const reqOptions = {
    url: `https://${account.storeName}.myshopify.com/admin/products.json`,
    headers: {
      'X-Shopify-Access-Token': account.token,
    },
  };
  return new Promise((resolve, reject) => {
    request(reqOptions, (error, response, body) => {
      if (error === null && response.statusCode === 200) {
        console.log('account in get products', account);
        const { _id } = account;
        const products = JSON.parse(body).products
          .map(product => Object.assign({}, product, { accountId: _id }));
        resolve(products);
      } else {
        console.log('error accessing store invetory data');
        reject(error);
      }
    });
  });
};

function saveProducts(db, products) {
  return new Promise((resolve, reject) => {
    db.collection('products').insertMany(products, (error, results) => {
      if (error) {
        console.log('error mirgrating product data');
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

function deleteProducts(db, account) {
  return new Promise((resolve, reject) => {
    const { _id } = account;
    db.collection('products').remove({ accountId: _id }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(account);
      }
    });
  });
}

function updateProducts(db, account, req, res) {
  deleteProducts(db, account)
    .then(getProducts)
    .then(products => saveProducts(db, products))
    .then(results => res.send(results))
    .catch(err => res.error(err));
}


migrationCtrl.checkForAccount = (req, res, next) => {
  const db = res.app.locals.db;
  const storeName = req.body.storeName;
  console.log('storeName before checking for account', storeName);
  db.collection('accounts').findOne({ storeName: req.body.storeName }, (err, account) => {
    if (err) {
      res.error(err);
    } else if (account) {
      console.log('account found already in database');
      updateProducts(db, account, req, res);
    } else {
      console.log('account not found');
      next();
    }
  });
};


migrationCtrl.import = (req, res) => {
  const db = res.app.locals.db;
  const storeName = res.locals.storeName;
  const token = res.locals.token;
  saveAccount(db, { storeName, token })
    .then(getProducts)
    .then(products => saveProducts(db, products))
    .then(results => res.json(results))
    .catch(err => res.error(err));
};

module.exports = migrationCtrl;
