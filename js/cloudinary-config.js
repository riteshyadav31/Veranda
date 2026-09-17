export const cloudinaryConfig = {
  cloudName: "dyn642ivy",
  uploadPreset: "veranda_unsigned"
};

export function isCloudinaryConfigured() {
  return Boolean(
    cloudinaryConfig.cloudName &&
    cloudinaryConfig.uploadPreset &&
    !cloudinaryConfig.cloudName.includes("YOUR_") &&
    !cloudinaryConfig.uploadPreset.includes("YOUR_")
  );
}

export function buildCloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
}
