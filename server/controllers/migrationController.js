const request = require('request');

const migrationCtrl = {};

// Thought I'd try with just vanilla mongo instead of an orm
function saveAccount(db, account, req) {
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
          req.session.key = account;
          console.log('account in success of save account', account);
          resolve(account);
        }
      });
    }
  });
}
// retrieves products from shopify store, adds account id to query for update
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
        try {
          const products = JSON.parse(body).products
            .map(product => Object.assign({}, product, { accountId: _id }));
          resolve(products);
        } catch (e) {
          reject(e);
        }
      } else {
        console.log('error accessing store invetory data');
        reject(error);
      }
    });
  });
};

// saves all products 
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

function updateProducts(db, account, req, res) {
  getProducts(account)
    .then(products =>
      Promise.all(products.map(product =>
        db.collection('products').updateOne({ id: product.id }, Object.assign({}, product), { upsert: true }))))
    .then((results) => {
      // const numUpdated = results.reduce((sum, item) => item.nModified ? sum + 1 : sum, 0);
      // const numAdded = results.reduce((sum, item) => item.upserted ? sum + 1 : sum, 0);
      // const message = `${numUpdated} product(s) updated and ${numAdded} products added`;
      res.json(results);
    })
    .catch(err => res.error(err));
}

// checks if already exsisting account data, if so then update from shopify
// else, proceed along middleware chain and request token
migrationCtrl.checkForAccount = (req, res, next) => {
  const db = res.app.locals.db;
  if (req.session.key) {
    console.log(`session found: ${JSON.stringify(req.session.key)}`);
    const { _id, storeName, token } = req.session.key;
    updateProducts(db, { _id, storeName, token }, req, res);
  } else {
    db.collection('accounts').findOne({ storeName: req.body.storeName }, (err, account) => {
      if (err) {
        res.error(err);
      } else if (account) {
        console.log('account found already in database');
        req.session.key = account;
        updateProducts(db, account, req, res);
      } else {
        console.log('account not found');
        next();
      }
    });
  }
};

migrationCtrl.import = (req, res) => {
  const db = res.app.locals.db;
  const storeName = res.locals.storeName;
  const token = res.locals.token;
  saveAccount(db, { storeName, token }, req)
    .then(getProducts)
    .then(products => saveProducts(db, products))
    .then(results => res.status(200).send(results.insertedCount ? `${results.insertedCount} product(s) added to Klickly!` : 'Couldn\'t find any items :('))
    // .then(results => res.status(200).send(results.insertedCount ? 'Couldn\'t find any items :(' : `${results.insertedCount} product(s) updated`))
    .catch(err => res.error(err));
};

module.exports = migrationCtrl;
