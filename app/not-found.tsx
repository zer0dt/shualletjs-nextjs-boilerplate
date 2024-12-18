import React from "react";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";

export default function NotFound() {
  redirect("/");
  return <div> foundnot</div>;
}