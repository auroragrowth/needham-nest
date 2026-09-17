import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // iPhone photos run 3-6MB; receipts shot at high res can be bigger.
  // Default server action body limit (1MB) silently rejects them.
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Stock control moved from /owner to /stock so managers can use it. Old
  // addresses (bookmarks, habits) still land in the right place.
  async redirects() {
    const moved = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      moved("/owner/stock", "/stock/items"),
      moved("/owner/stock/new", "/stock/items/new"),
      moved("/owner/stock/overview", "/stock/overview"),
      moved("/owner/stock/alerts", "/stock/alerts"),
      moved("/owner/stock/locations", "/stock/location-setup"),
      moved("/owner/stock/:id", "/stock/items/:id"),
      moved("/owner/suppliers/:path*", "/stock/suppliers/:path*"),
      moved("/owner/deliveries/:path*", "/stock/deliveries/:path*"),
      moved("/owner/order-pad", "/stock/order-pad"),
    ];
  },
};

export default nextConfig;
