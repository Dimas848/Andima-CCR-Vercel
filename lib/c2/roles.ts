export const FAT_ROLES = [
  "Accounting Associate", "Accounting Associate 1", "Accounting Associate 2",
  "Tax Associate", "Tax Associate 1", "Tax Associate 2", "Cash Manager Associate",
  "Manager of Accounting", "Tax Manager", "Cash Manager", "Director of FAT",
  "Director of Finance, Accounting & Digital Transformation",
] as const;
export const VALIDATE_ROLES = [
  "Manager of Accounting", "Tax Manager", "Director of FAT",
  "Director of Finance, Accounting & Digital Transformation",
] as const;
export const DELETE_ROLES = [...VALIDATE_ROLES, "Cash Manager"] as const;
export const isFatRole = (role: string) => (FAT_ROLES as readonly string[]).includes(role);
export const canValidate = (role: string) => (VALIDATE_ROLES as readonly string[]).includes(role);
export const canDeleteEvidence = (role: string) => (DELETE_ROLES as readonly string[]).includes(role);
