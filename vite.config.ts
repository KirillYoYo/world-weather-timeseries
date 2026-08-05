import {defineConfig} from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'


export default defineConfig({
    plugins: [react()], resolve: {
        // @ts-ignore
        src: path.resolve(__dirname, './src'),
    }, server: {
        open: true,
        port: 9000,
    },
})