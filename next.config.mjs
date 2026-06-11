/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    sassOptions: {
        includePaths: ['./src', './styles'], // пути для @import
        prependData: `@import "vars.scss";` // глобальные переменные
    },
    // Ant Design — НЕ нужен transpileModules в App Router!
    // transpilePackages: [
    //     'antd',
    //     'rc-pagination',
    //     'rc-util',
    //     'rc-picker',
    //     'rc-overflow',
    //     'rc-resize-observer',
    //     'rc-motion'
    // ],
    // экспериментальная поддержка AntD (Next.js 14+)
    // experimental: {
    //     optimizePackageImports: ['antd']
    // }
};

export default nextConfig;