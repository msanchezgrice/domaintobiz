export default async function handler(req, res) {
  const { slug } = req.query;
  
  return res.status(200).json({
    success: true,
    message: 'Dynamic routing works!',
    slug: slug,
    timestamp: new Date().toISOString()
  });
}