import { useEffect, useRef, useState } from "react"

interface Location {
    name: string
    country: string
    admin1: string
    lat: number
    lon: number
}

function saveLocation(loc: Location) {
    document.cookie = `location=${encodeURIComponent(JSON.stringify(loc))};max-age=${60 * 60 * 24 * 365};path=/`
}

function loadLocation(): Location | null {
    const match = document.cookie.split("; ").find(r => r.startsWith("location="))
    if (!match) return null
    try {
        return JSON.parse(decodeURIComponent(match.split("=")[1]))
    } catch {
        return null
    }
}

function toDateString(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function TemperatureDashboard() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [location, setLocation] = useState<Location | null>(() => loadLocation())
    const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()))

    const [query, setQuery] = useState("")
    const [results, setResults] = useState<Location[]>([])
    const [searching, setSearching] = useState(false)
    const [showSearch, setShowSearch] = useState(false)

    useEffect(() => {
        setLoading(true)
        setError(null)
        setData(null)
        const params = new URLSearchParams()
        if (location) {
            params.set("lat", String(location.lat))
            params.set("lon", String(location.lon))
        }
        params.set("date", selectedDate)
        fetch(`/api/getTemperatures?${params}`)
            .then(r => r.json())
            .then(setData)
            .catch(() => setError("Failed to load"))
            .finally(() => setLoading(false))
    }, [location, selectedDate])

    async function search() {
        if (!query.trim()) return
        setSearching(true)
        try {
            const res = await fetch(`/api/geocode?name=${encodeURIComponent(query)}`)
            const data = await res.json()
            setResults(data.locations ?? [])
        } catch {
            setResults([])
        } finally {
            setSearching(false)
        }
    }

    function handleSelect(loc: Location) {
        setLocation(loc)
        saveLocation(loc)
        setResults([])
        setQuery("")
        setShowSearch(false)
    }

    const displayName = location ? location.name : "Kalmar"
    const displayCoords = location
        ? `${location.lat.toFixed(2)}°N ${location.lon.toFixed(2)}°E`
        : "56.66°N 16.36°E"

    const allMaxes = data
        ? data.history.map((d: any) => d.max).filter((v: any) => v != null)
        : []
    const hottest = allMaxes.length ? Math.max(...allMaxes) : null
    const coldest = allMaxes.length ? Math.min(...allMaxes) : null

    function tempColor(temp: number | null) {
        if (temp == null) return "text-slate-500"
        if (temp === hottest) return "text-red-400"
        if (temp === coldest) return "text-blue-400"
        return "text-slate-100"
    }

    const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })
    const todayStr = toDateString(new Date())
    const isFuture = data?.isFuture
    const isToday = selectedDate === todayStr

    const searchRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearch(false)
                setResults([])
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-900">
            <div className="w-full max-w-sm">

                <div className="mb-6 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <img src="/daisy-logo.png" className="w-8 h-8" />
                        <span className="text-sm font-medium text-slate-500 tracking-widest">mydaisy</span>
                    </div>
                    <button
                        onClick={() => setShowSearch(s => !s)}
                        className="flex items-center justify-center gap-2 mx-auto text-4xl font-bold text-slate-100 hover:text-blue-400 transition-colors tracking-tight"
                    >
                        {displayName}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-500 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 21c-4.418-4.418-7-8.075-7-11a7 7 0 1 1 14 0c0 2.925-2.582 6.582-7 11z" />
                            <circle cx="12" cy="10" r="2.5" />
                        </svg>
                    </button>
                    <p className="text-xs text-slate-600 mt-2 tracking-widest uppercase">Vädret nu och då</p>
                </div>

                {showSearch && (
                    <div className="mb-4" ref={searchRef}>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && search()}
                                placeholder="Sök efter plats..."
                                autoFocus
                                className="flex-1 text-sm px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={search}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-500 active:scale-95 transition-all"
                            >
                                {searching ? "…" : "Search"}
                            </button>
                        </div>
                        {results.length > 0 && (
                            <div className="mt-2 border border-slate-700 rounded-xl overflow-hidden bg-slate-800 shadow-sm">
                                {results.map((loc, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSelect(loc)}
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-700 border-b border-slate-700 last:border-0 transition-colors"
                                    >
                                        <span className="font-medium text-slate-100">{loc.name}</span>
                                        <span className="text-slate-400 ml-2">{loc.admin1 && `${loc.admin1}, `}{loc.country}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4 flex items-center gap-2">
                    <select
                        value={String(new Date(selectedDate + "T12:00:00").getMonth() + 1)}
                        onChange={e => {
                            const d = new Date(selectedDate + "T12:00:00")
                            d.setMonth(parseInt(e.target.value) - 1)
                            setSelectedDate(toDateString(d))
                        }}
                        className="flex-1 text-sm px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"].map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={new Date(selectedDate + "T12:00:00").getDate()}
                        onChange={e => {
                            const d = new Date(selectedDate + "T12:00:00")
                            d.setDate(parseInt(e.target.value))
                            setSelectedDate(toDateString(d))
                        }}
                        className="flex-1 text-sm px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    {!isToday && (
                        <button
                            onClick={() => setSelectedDate(todayStr)}
                            className="px-4 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"
                        >
                            Idag
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 shadow-sm">
                        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-600 animate-pulse">
                            <div className="h-5 w-24 bg-blue-500 rounded-lg mx-auto mb-3" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="h-3 w-8 bg-blue-500 rounded mb-2" />
                                    <div className="h-10 w-20 bg-blue-500 rounded-lg" />
                                </div>
                                <div className="text-right">
                                    <div className="h-3 w-16 bg-blue-500 rounded mb-2" />
                                    <div className="h-6 w-14 bg-blue-500 rounded-lg" />
                                </div>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-700">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between px-5 py-3">
                                    <div className="h-4 w-10 bg-slate-700 rounded animate-pulse" />
                                    <div className="flex gap-3">
                                        <div className="h-4 w-10 bg-slate-700 rounded animate-pulse" />
                                        <div className="h-4 w-10 bg-slate-700 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-800 shadow-sm p-10 text-center">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                ) : (
                    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 shadow-sm">
                        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-600">
                            <p className="text-lg font-medium text-white tracking-wide mb-3 capitalize text-center">{dateLabel}</p>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-blue-200 mb-1">
                                        {isToday ? "Nu" : isFuture ? "Min prognos" : "Min"}
                                    </p>
                                    <p className="text-2xl font-medium text-white">
                                        {data.today.current != null ? `${data.today.current.toFixed(1)}°` : "N/A"}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-blue-200 mb-1">Nederbörd</p>
                                    <p className="text-2xl font-medium text-white">
                                        {data.today.rain ? `${data.today.rain.toFixed(1)}mm` : "—"}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-blue-200 mb-1">
                                        {isToday ? "Max idag" : isFuture ? "Max prognos" : "Max"}
                                    </p>
                                    <p className="text-2xl font-medium text-white">
                                        {data.today.max != null ? `${data.today.max.toFixed(1)}°C` : "N/A"}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-700">
                            {data.history.map((item: any) => (
                                <div key={item.year} className="flex items-center justify-between px-5 py-3">
                                    <span className="text-sm text-slate-400">{item.year}</span>
                                    <div className="flex gap-3 text-sm font-bold">
                                        <span className="text-blue-400 w-14 text-right">
                                            {item.rain ? `${item.rain.toFixed(1)}mm` : ""}
                                        </span>
                                        <span className="text-gray-400 w-14 text-right">
                                            {item.min != null ? `${item.min.toFixed(1)}°` : "—"}
                                        </span>
                                        <span className={`${tempColor(item.max)} w-14 text-right`}>
                                            {item.max != null ? `${item.max.toFixed(1)}°` : "—"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-center text-xs text-slate-600 mt-4">{displayCoords}</p>

            </div>
        </div>
    )
}