# Roles and teacher–student access

## Roles

- `student` — the default for every new account. The app never shows this label.
- `teacher` — can invite students and create student-only folder links.
- `admin` — can assign roles and use teacher tools.

Users cannot choose a role. To become a teacher they email support at
`andriukluba@gmail.com`; an admin then assigns `teacher` manually.

Roles live in `roles/{uid}`, separately from editable user profiles. A user can
create only their own initial `student` role. Only an existing admin can change
another user's role. Admin rules intentionally do not grant access to private
`users/{uid}/words` or `users/{uid}/folders`.

## Student invitations

1. A teacher opens `/teacher` and enters the student's email.
2. InkLex creates a random, seven-day invitation link.
3. The student signs in with exactly that email and accepts the link.
4. Firestore atomically accepts the invite and creates
   `teachers/{teacherUid}/students/{studentUid}`.

InkLex currently creates and copies the invitation link; it does not send email.
Removing a student immediately removes access to that teacher's student-only
links. A student can belong to more than one teacher.

## Shared folder visibility

- `public` — anyone with the link can preview the immutable snapshot.
- `students` — only the owner and students linked to that teacher can read it.

Visibility is fixed when the snapshot is published. Existing snapshots without
a visibility field remain public for backward compatibility.

## Bootstrap the first admin

Find the account UID in Firebase Console → Authentication → Users. Authenticate
the Admin SDK with Application Default Credentials, then run:

```bash
npm run set:role -- --uid FIREBASE_UID --role admin --project inklex-be --apply
```

Without `--apply`, the command performs a dry run. After assigning the role,
sign out and back in (or reload) so the app refreshes the access profile.

## Deployment

Deploy Firestore rules before deploying the frontend:

```bash
firebase deploy --only firestore:rules --project inklex-be
```

Then deploy the app. User profile and default-role documents are created on the
first authenticated app load.

In mock DB mode (`VITE_USE_MOCK_DB=true`), the `local-dev` account is an admin so
Students and Admin screens can be exercised without Firebase.
