export default async function handler(req, res) {
    const { name } = req.query

    if (!name) {
        return res.status(400).json({ error: "Missing name parameter" })
    }

    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`
        const response = await fetch(url)
        const data = await response.json()

        if (!data.results?.length) {
            return res.status(404).json({ error: "No locations found" })
        }

        const locations = data.results.map((r) => ({
            name: r.name,
            country: r.country,
            admin1: r.admin1,
            lat: r.latitude,
            lon: r.longitude,
        }))

        res.status(200).json({ locations })
    } catch (error) {
        console.error("Geocoding error:", error)
        res.status(500).json({ error: "Failed to fetch locations" })
    }
}