// routes/home.js
module.exports = function (router) {
    router.get('/', (req, res) => {
      res.status(200).json({ message: 'OK', data: { uptime: process.uptime() } });
    });
    return router;
  };
  