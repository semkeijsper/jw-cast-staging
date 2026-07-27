<script setup lang="ts">
// Redirect / → /:browserLanguage or /nl
const lang = navigator.language.split('-', 1)[0] ?? 'nl';
await navigateTo(`/${lang}`, { replace: true });
</script>
