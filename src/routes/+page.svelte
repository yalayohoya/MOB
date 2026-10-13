<script lang="ts">
  import { onMount } from "svelte";
  import { pageTitle, isInitialized } from "$lib/stores/ui";
  import { auth } from "$lib/stores/auth";
  import LoginScreen from "$lib/components/LoginScreen.svelte";
  import DashboardScreen from "$lib/components/DashboardScreen.svelte";

  onMount(() => {
    pageTitle.set("SecureScan Ops");
  });
</script>

{#if $isInitialized}
  {#if !$auth.isLoggedIn}
    <LoginScreen />
  {:else}
    <DashboardScreen />
  {/if}
{/if}

<style>
  /* 페이지 디자인/역할: 대시보드 진입점이며 주요 기능을 카드 형태로 배치함 */
</style>
