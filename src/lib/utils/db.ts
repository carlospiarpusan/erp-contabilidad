/**
 * Cleans an object intended for a database insert or update,
 * converting empty strings in UUID-like fields to null.
 * 
 * @param payload The object to clean
 * @param uuidFields List of field names that are UUIDs and should be null if empty string
 * @returns The cleaned object
 */
export function cleanUUIDs<T extends Record<string, any>>(payload: T, uuidFields: string[]): T {
    const cleaned = { ...payload }
    for (const field of uuidFields) {
        if (cleaned[field] === '') {
            cleaned[field as keyof T] = null as any
        }
    }
    return cleaned
}
