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

export default async function handler(req, res) {
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
            console.log("Fetching today's temperature…")
            const todayUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
            const todayResponse = await fetchWithTimeout(todayUrl)
            const todayData = await todayResponse.json()
            todayTemp = todayData?.current_weather?.temperature ?? null
            todayMax = todayData?.daily?.temperature_2m_max?.[0] ?? null
            todayRain = todayData?.daily?.precipitation_sum?.[0] ?? null
            console.log("Today current:", todayTemp, "max:", todayMax, "rain:", todayRain)

        } else if (isFuture) {
            console.log("Fetching forecast for:", requestedDate)
            const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${requestedDate}&end_date=${requestedDate}`
            const forecastResponse = await fetchWithTimeout(forecastUrl)
            const forecastData = await forecastResponse.json()
            todayMax = forecastData?.daily?.temperature_2m_max?.[0] ?? null
            todayTemp = forecastData?.daily?.temperature_2m_min?.[0] ?? null
            todayRain = forecastData?.daily?.precipitation_sum?.[0] ?? null
            console.log("Forecast min:", todayTemp, "max:", todayMax, "rain:", todayRain)

        } else {
            console.log("Fetching archive for:", requestedDate)
            const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${requestedDate}&end_date=${requestedDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
            const archiveResponse = await fetchWithTimeout(archiveUrl)
            const archiveData = await archiveResponse.json()
            todayMax = archiveData?.daily?.temperature_2m_max?.[0] ?? null
            todayTemp = archiveData?.daily?.temperature_2m_min?.[0] ?? null
            todayRain = archiveData?.daily?.precipitation_sum?.[0] ?? null
            console.log("Archive min:", todayTemp, "max:", todayMax, "rain:", todayRain)
        }

        const currentYear = now.getFullYear()
        const years = Array.from({ length: 10 }, (_, i) => currentYear - 1 - i)

        console.log("Fetching historical temps…")
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
                console.log(`${date}: min ${minTemp} max ${maxTemp} rain ${rain}`)
                history.push({ year, max: maxTemp, min: minTemp, rain })
            } catch (err) {
                console.error(`Failed ${date}`, err)
                history.push({ year, max: null, min: null, rain: null })
            }
        }

        res.status(200).json({
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
}