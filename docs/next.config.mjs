import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ['@gx/core', '@gx/primitives', '@gx/react'],
};

export default withMDX(config);
