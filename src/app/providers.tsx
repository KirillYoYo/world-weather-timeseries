'use client'

import React, { ReactNode } from 'react'
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'

// Глобальный Apollo-клиент для клиентской части
const client = new ApolloClient({
    uri: 'http://localhost:3000/graphql',
    cache: new InMemoryCache(),
})

type ProvidersProps = {
    children: ReactNode
}

const Providers = ({ children }: ProvidersProps) => {
    return (
        <ApolloProvider client={client}>
            {children}
        </ApolloProvider>
    )
}

export default Providers