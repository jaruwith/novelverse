import { permanentRedirect } from "next/navigation";

export default function CreatorIndexPage() {
  permanentRedirect("/creator/dashboard");
}
