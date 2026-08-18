export function registerOutputRoutes(app, { getOutputRegistry, hasOutput }) {
  app.get('/api/outputs', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...getOutputRegistry() });
  });

  app.get('/api/outputs/:outputId', (req, res) => {
    const outputId = req.params.outputId;
    const exists = hasOutput(outputId);
    res.set('Cache-Control', 'no-store');
    res.status(exists ? 200 : 404).json({ success: exists, output: outputId, exists });
  });
}
