<script lang="ts">
  let testVal = $state("");
</script>

<div class="flex items-center gap-1.5 p-4">
  <button
    type="button"
    onclick={() => {
      if (testVal.startsWith("-")) {
        testVal = testVal.slice(1);
      } else {
        testVal = "-" + testVal;
      }
    }}
    class="px-2.5 py-1.5 border-2 border-slate-700 dark:border-zinc-400 bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-lg text-xs font-black hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-sm shrink-0"
    title="양수/음수 전환"
  >
    ±
  </button>
  <input
    type="text"
    inputmode="decimal"
    pattern="[0-9.-]*"
    bind:value={testVal}
    oninput={(e) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      const target = e.target;
      let val = target.value.replace(/[^0-9.-]/g, "");

      // 마이너스(-) 기호는 맨 앞에만 허용
      const isNegative = val.startsWith("-");
      val = val.replace(/-/g, "");
      if (isNegative) val = "-" + val;

      // 소수점(.)은 첫 번째 1개만 허용
      const parts = val.split(".");
      if (parts.length > 2) {
        val = parts[0] + "." + parts.slice(1).join("");
      }

      // 최대 10자 제한
      if (val.length > 10) {
        val = val.slice(0, 10);
      }

      testVal = val;
      target.value = val;
    }}
    class="highlighted-input w-24 sm:w-28 px-3 py-1.5 border-2 border-slate-700 dark:border-zinc-400 bg-slate-50 dark:bg-zinc-800/60 rounded-lg text-center text-xs font-black text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 hover:border-slate-900 dark:hover:border-white focus:bg-white dark:focus:bg-zinc-950 focus:outline-none transition-all shadow-sm"
  />
</div>

<div>
  <p>any</p>
  <input type="number" step="any" />
</div>
<div>
  <p>numeric</p>
  <input inputmode="numeric" placeholder="numeric" />
</div>
