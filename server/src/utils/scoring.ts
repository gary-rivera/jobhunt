function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);

  const magnitudeA: number = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB: number = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

  log.success('[cosineSimilarity] Calculated score between vectors');
  return dotProduct / (magnitudeA * magnitudeB);
}

export { cosineSimilarity };
