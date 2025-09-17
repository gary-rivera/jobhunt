type NomicEmbeddingVector = readonly number[] & { length: 768 };

function cosineSimilarity(vectorA: NomicEmbeddingVector, vectorB: NomicEmbeddingVector): number {
  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);

  const magnitudeA: number = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB: number = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

  return dotProduct / (magnitudeA * magnitudeB);
}

// TODO: implement?
// function interpretSimilarityScore(score: number): any {}

export { cosineSimilarity };
