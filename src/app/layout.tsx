import type { ReactNode } from 'react'

import '../globalStyles.scss'
import '../fonts.scss'
import Providers from './providers'

type RootLayoutProps = {
    children: ReactNode
}

const RootLayout = ({ children }: RootLayoutProps) => {
    return (
        <html lang="en">
            <body data-theme="dark">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}

export default RootLayout