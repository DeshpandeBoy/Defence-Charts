import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ['@shiftcharts/core', '@shiftcharts/primitives', '@shiftcharts/react'],
};

export default withMDX(config);
