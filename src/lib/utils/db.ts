export function cleanUUIDs<T extends Record<string, any>>(payload: T, uuidFields?: string[]): T {
    const cleaned = { ...payload }

    // If uuidFields is provided, clean those specific fields
    if (uuidFields) {
        for (const field of uuidFields) {
            if (cleaned[field] === '') {
                cleaned[field as keyof T] = null as any
            }
        }
        return cleaned
    }

    // Otherwise, automatically clean any field that looks like a UUID reference
    for (const key in cleaned) {
        if ((key === 'id' || key.endsWith('_id')) && cleaned[key] === '') {
            cleaned[key] = null as any
        }
    }

    return cleaned
}
