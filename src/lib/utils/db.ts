export function cleanUUIDs<T extends Record<string, any>>(payload: T, uuidFields?: string[]): T {
    const cleaned = { ...payload }

    // If uuidFields is provided, handle those specifically
    if (uuidFields) {
        for (const field of uuidFields) {
            const val = cleaned[field]
            if (val === '' || val === undefined) {
                cleaned[field as keyof T] = null as any
            }
        }
        return cleaned
    }

    // Automatically clean any field that looks like a UUID reference (id or *_id)
    for (const key in cleaned) {
        // We check for id, *_id, or any key that is commonly a UUID
        const isUUIDField = key === 'id' || key.endsWith('_id') || key.endsWith('Id')

        if (isUUIDField) {
            if (cleaned[key] === '' || cleaned[key] === undefined) {
                cleaned[key] = null as any
            }
        }
    }

    return cleaned
}
