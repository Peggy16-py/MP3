// routes/index.js
const express = require('express');

module.exports = function (app, routerArg) {
  // Use the router passed from server.js if provided, otherwise create one.
  const router = routerArg || express.Router();

  // Home: GET /api/
  require('./home')(router);

  // Resource routers (create users.js & tasks.js below)
  router.use('/users', require('./users'));
  router.use('/tasks', require('./tasks'));

  // Mount everything under /api
  app.use('/api', router);

  // 404 for anything else
  app.use((req, res) => {
    res.status(404).json({ message: 'Not Found', data: null });
  });

  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message || 'Server error', data: null });
  });
};
