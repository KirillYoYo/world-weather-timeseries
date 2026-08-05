import React from 'react'
import '../fonts.scss'
import Weather from '../weather/Weather'

/*worker*/
import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// @ts-ignore
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
setWorkerUrl(workerUrl)
/*worker*/

const App: React.FC = () => {
    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Weather />
        </div>
    )
}

export default App