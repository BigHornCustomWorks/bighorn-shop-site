import { redirect } from "next/navigation";
import { isMaster } from "@/lib/auth";
import { MasterClient } from "./MasterClient";

export default async function MasterPage() {
  if (!(await isMaster())) redirect("/master/login");
  return <MasterClient />;
}
