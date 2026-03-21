const DEMO_MODE = process.env.DEMO_MODE === 'true';

function blockInDemo(req, res, next) {
  if (DEMO_MODE) return res.status(403).json({ error: 'Disabled in demo mode' });
  next();
}

module.exports = { DEMO_MODE, blockInDemo };
