import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dashboard", destination: "/creator/dashboard", permanent: true },
      { source: "/dashboard/profile", destination: "/creator/profile", permanent: true },
      { source: "/dashboard/stories", destination: "/creator/stories", permanent: true },
      { source: "/dashboard/stories/new", destination: "/creator/stories", permanent: true },
      { source: "/dashboard/stories/:id/edit", destination: "/creator/stories/:id", permanent: true },
      { source: "/dashboard/stories/:id/chapters/new", destination: "/creator/stories/:id", permanent: true },
      { source: "/dashboard/stories/:id/chapters", destination: "/creator/stories/:id", permanent: true },
      { source: "/stories/new", destination: "/creator/stories", permanent: true },
      { source: "/dashboard/analytics", destination: "/creator/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
