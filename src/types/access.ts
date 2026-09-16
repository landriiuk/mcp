export type UserRole = "student" | "teacher" | "admin";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type TeacherInviteStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

export type TeacherInvite = {
  id: string;
  teacherUid: string;
  teacherName: string;
  studentEmail: string;
  status: TeacherInviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedByUid: string | null;
};

export type TeacherStudent = {
  uid: string;
  email: string;
  displayName: string | null;
  acceptedAt: string;
};
