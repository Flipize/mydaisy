import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

function fetchWithTimeout(url, ms = 8000) {
    let timeoutId
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Fetch timeout")), ms)
    })
    return Promise.race([
        fetch(url).finally(() => clearTimeout(timeoutId)),
        timeout
    ])
}

app.get('/api/geocode', async (req, res) => {
    const { name } = req.query
    if (!name) return res.status(400).json({ error: "Missing name parameter" })
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`
        const response = await fetchWithTimeout(url)
        const data = await response.json()
        if (!data.results?.length) return res.status(404).json({ error: "No locations found" })
        const locations = data.results.map(r => ({
            name: r.name,
            country: r.country,
            admin1: r.admin1,
            lat: r.latitude,
            lon: r.longitude,
        }))
        res.json({ locations })
    } catch (error) {
        console.error("Geocoding error:", error)
        res.status(500).json({ error: "Failed to fetch locations" })
    }
})

app.get('/api/getTemperatures', async (req, res) => {
    try {
        const lat = req.query.lat ? parseFloat(req.query.lat) : 56.6634
        const lon = req.query.lon ? parseFloat(req.query.lon) : 16.3566

        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        const requestedDate = req.query.date || todayStr
        const [reqYear, reqMonth, reqDay] = requestedDate.split("-").map(Number)
        const todayMMDD = `${String(reqMonth).padStart(2, '0')}-${String(reqDay).padStart(2, '0')}`

        const requestedDateObj = new Date(requestedDate)
        const isToday = requestedDate === todayStr
        const isFuture = requestedDateObj > now
        const isPastThisYear = !isToday && !isFuture && reqYear === now.getFullYear()

        let todayTemp = null
        let todayMax = null
        let todayRain = null

        if (isToday) {
            const todayUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
            const todayResponse = await fetchWithTimeout(todayUrl)
            const todayData = await todayResponse.json()
            todayTemp = todayData?.current_weather?.temperature ?? null
            todayMax = todayData?.daily?.temperature_2m_max?.[0] ?? null
            todayRain = todayData?.daily?.precipitation_sum?.[0] ?? null

        } else if (isFuture) {
            const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${requestedDate}&end_date=${requestedDate}`
            const forecastResponse = await fetchWithTimeout(forecastUrl)
            const forecastData = await forecastResponse.json()
            todayMax = forecastData?.daily?.temperature_2m_max?.[0] ?? null
            todayTemp = forecastData?.daily?.temperature_2m_min?.[0] ?? null
            todayRain = forecastData?.daily?.precipitation_sum?.[0] ?? null

        } else {
            const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${requestedDate}&end_date=${requestedDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
            const archiveResponse = await fetchWithTimeout(archiveUrl)
            const archiveData = await archiveResponse.json()
            todayMax = archiveData?.daily?.temperature_2m_max?.[0] ?? null
            todayTemp = archiveData?.daily?.temperature_2m_min?.[0] ?? null
            todayRain = archiveData?.daily?.precipitation_sum?.[0] ?? null
        }

        const currentYear = now.getFullYear()
        const years = Array.from({ length: 10 }, (_, i) => currentYear - 1 - i)

        const history = []
        for (const year of years) {
            const date = `${year}-${todayMMDD}`
            const historyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
            try {
                const histRes = await fetchWithTimeout(historyUrl)
                const data = await histRes.json()
                const maxTemp = data?.daily?.temperature_2m_max?.[0] ?? null
                const minTemp = data?.daily?.temperature_2m_min?.[0] ?? null
                const rain = data?.daily?.precipitation_sum?.[0] ?? null
                history.push({ year, max: maxTemp, min: minTemp, rain })
            } catch (err) {
                console.error(`Failed ${date}`, err)
                history.push({ year, max: null, min: null, rain: null })
            }
        }

        res.json({
            today: { current: todayTemp, max: todayMax, rain: todayRain },
            isToday,
            isFuture,
            requestedDate,
            history
        })
    } catch (error) {
        console.error("API ERROR:", error)
        res.status(500).json({ error: "Failed to fetch temperatures" })
    }
})

app.use(express.static(path.join(__dirname, 'dist')))
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})