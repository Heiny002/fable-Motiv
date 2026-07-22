import { redirect } from "next/navigation";

// The old mood check-in tab was merged into the Today ("Check-in") tab.
// Keep this route alive so existing push links / bookmarks don't 404.
export default function CheckInPage() {
  redirect("/today");
}
