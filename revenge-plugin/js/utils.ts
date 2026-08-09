/**
 * Utility functions for Revenge.
 */
import { getModule } from "@revenge-mod/modules/finders";

/**
 * A helper to insert text into the chat input natively on Revenge.
 * It searches for the ComponentDispatch module to trigger the INSERT_TEXT event.
 */
export function insertTextIntoChatInputBox(text: string) {
    // In Revenge/RN, dispatching text directly requires hooking into ComponentDispatch
    const ComponentDispatch = getModule((m: any) => m?.dispatch && m?.subscribe);
    if (ComponentDispatch) {
        ComponentDispatch.dispatch("INSERT_TEXT", {
            plainText: text,
        });
    } else {
        console.warn("Could not find ComponentDispatch to insert text");
    }
}
