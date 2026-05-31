export function buildLineageChain({
  sourceImage = "Unknown Source",
  featureExtraction = "Feature Extraction",
  graphicTranslation = "Graphic Translation",
  aiReference = "AI Reference",
  architecturalProjection = "Pending Projection",
} = {}) {
  return {
    source_image: sourceImage,
    feature_extraction: featureExtraction,
    graphic_translation: graphicTranslation,
    ai_reference: aiReference,
    architectural_projection: architecturalProjection,
  };
}

