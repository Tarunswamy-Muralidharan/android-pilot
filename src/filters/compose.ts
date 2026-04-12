/**
 * Extract Compose testTag from resource-id.
 *
 * Jetpack Compose exposes Modifier.testTag("myTag") via the accessibility tree
 * as the resource-id field, typically in the format "packagename:id/myTag".
 * Some versions just use "myTag" directly.
 */
export function extractTestTag(resourceId: string): string {
  if (!resourceId) return "";

  // Format: "com.example.app:id/my_test_tag"
  const idMatch = resourceId.match(/:id\/(.+)$/);
  if (idMatch) return idMatch[1];

  // If no colon format, the whole string might be the tag
  // But skip Android system resource IDs
  if (resourceId.startsWith("android:") || resourceId.startsWith("com.android.")) {
    return "";
  }

  return resourceId;
}
