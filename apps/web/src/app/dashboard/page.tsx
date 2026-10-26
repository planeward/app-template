import type { Metadata } from "next";

import { DashboardView } from "../_components/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardView />;
}
