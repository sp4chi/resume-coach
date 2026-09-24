// One place that builds storage keys.
//
// The worst upload bug is when the file is saved at one key but the database
// records a different one: storage returns 200, the file is really there, and
// the app can never find it. Deriving every key from one function stops that.

export const resumeKey = (userId: string, uploadId: string, filename: string) =>
  `resumes/${userId}/${uploadId}/${sanitize(filename)}`;

export const sanitize = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
