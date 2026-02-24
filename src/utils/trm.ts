/**
 * Servicio para obtener y manejar TRM (Tasa de Cambio Representativa del Mercado)
 * Usa la API de Banco de la República de Colombia
 */

const TRM_CACHE_KEY = "trm_cache";
const TRM_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

interface TRMCacheEntry {
  value: number;
  date: string;
  timestamp: number;
}

let trmCache: TRMCacheEntry | null = null;

/**
 * Obtiene el TRM actual desde la API del Banco de la República
 * Fallback a TRM aproximado (3900) si la API falla
 */
export async function getTRMColombia(): Promise<number> {
  // Verificar caché
  if (trmCache && Date.now() - trmCache.timestamp < TRM_CACHE_DURATION) {
    return trmCache.value;
  }

  try {
    // API del Banco de la República - retorna el TRM del día actual
    const response = await fetch(
      "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigencia DESC",
      {
        headers: {
          "User-Agent": "Viomar-App/1.0",
        },
      }
    );

    if (!response.ok) {
      console.warn("TRM API falló, usando valor aproximado");
      return getApproximateTRM();
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const trmValue = parseFloat(String(data[0].valor).replace(",", "."));

      if (!Number.isNaN(trmValue)) {
        trmCache = {
          value: trmValue,
          date: data[0].vigencia,
          timestamp: Date.now(),
        };

        return trmValue;
      }
    }

    console.warn("TRM API retornó datos inválidos, usando valor aproximado");
    return getApproximateTRM();
  } catch (error) {
    console.warn("Error al obtener TRM:", error, "usando valor aproximado");
    return getApproximateTRM();
  }
}

/**
 * Obtiene TRM aproximado (valor por defecto)
 * En producción, usar un proveedor de data más confiable
 */
export function getApproximateTRM(): number {
  // Valor aproximado - se debe actualizar regularmente
  // Basado en histórico reciente de TRM
  return 3900;
}

/**
 * Convierte COP a USD usando TRM
 */
export async function convertCOPtoUSD(copAmount: number | string): Promise<number> {
  const cop = typeof copAmount === "string" ? parseFloat(copAmount) : copAmount;
  const trm = await getTRMColombia();

  if (!Number.isFinite(cop) || !Number.isFinite(trm) || trm === 0) {
    return 0;
  }

  return Math.round((cop / trm) * 100) / 100;
}

/**
 * Convierte USD a COP usando TRM
 */
export async function convertUSDtoCOP(usdAmount: number | string): Promise<number> {
  const usd = typeof usdAmount === "string" ? parseFloat(usdAmount) : usdAmount;
  const trm = await getTRMColombia();

  if (!Number.isFinite(usd) || !Number.isFinite(trm)) {
    return 0;
  }

  return Math.round(usd * trm * 100) / 100;
}

/**
 * Aplica conversión de precio base en COP a USD, o viceversa
 * Retorna el precio convertido y el TRM usado
 */
export async function applyTRMConversion(args: {
  priceCopBase?: string | number | null;
  priceUSD?: string | number | null;
  sourceCurrency: "COP" | "USD";
}): Promise<{
  priceCopBase: number | null;
  priceUSD: number | null;
  trmUsed: number;
}> {
  const { priceCopBase, priceUSD, sourceCurrency } = args;
  const trm = await getTRMColombia();

  if (sourceCurrency === "COP" && priceCopBase) {
    const cop = typeof priceCopBase === "string" ? parseFloat(priceCopBase) : priceCopBase;
    
    if (Number.isFinite(cop)) {
      return {
        priceCopBase: cop,
        priceUSD: Math.round((cop / trm) * 100) / 100,
        trmUsed: trm,
      };
    }
  } else if (sourceCurrency === "USD" && priceUSD) {
    const usd = typeof priceUSD === "string" ? parseFloat(priceUSD) : priceUSD;
    
    if (Number.isFinite(usd)) {
      return {
        priceCopBase: Math.round(usd * trm * 100) / 100,
        priceUSD: usd,
        trmUsed: trm,
      };
    }
  }

  return {
    priceCopBase: null,
    priceUSD: null,
    trmUsed: trm,
  };
}
