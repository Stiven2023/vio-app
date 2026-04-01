import type {
  ClientPriceType,
  OrderType,
  PaymentTerm,
  PrefactureOrderType,
  QuoteProcess,
  UiLocale,
} from "./types";

type Option<T extends string> = {
  value: T;
  label: string;
};

export const DEFAULT_COUNTRY = "COLOMBIA";
export const DEFAULT_PAYMENT_TERM: PaymentTerm = "TRANSFERENCIA";

const CLIENT_PRICE_TYPE_LABELS: Record<
  UiLocale,
  Record<ClientPriceType, string>
> = {
  en: {
    AUTORIZADO: "Authorized",
    MAYORISTA: "Wholesale",
    VIOMAR: "Viomar",
    COLANTA: "Colanta",
  },
  es: {
    AUTORIZADO: "Autorizado",
    MAYORISTA: "Mayorista",
    VIOMAR: "Viomar",
    COLANTA: "Colanta",
  },
};

const PAYMENT_TERM_LABELS: Record<UiLocale, Record<PaymentTerm, string>> = {
  en: {
    TRANSFERENCIA: "Transfer",
    EFECTIVO: "Cash",
    TARJETA: "Card",
    CHEQUE: "Check",
    CREDITO: "Credit",
    OTROS: "Others",
  },
  es: {
    TRANSFERENCIA: "Transferencia",
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    CHEQUE: "Cheque",
    CREDITO: "Credito",
    OTROS: "Otros",
  },
};

const ORDER_TYPE_LABELS: Record<UiLocale, Record<OrderType, string>> = {
  en: {
    NORMAL: "New",
    COMPLETACION: "Completion",
    REFERENTE: "Reference",
    REPOSICION: "Replacement",
    MUESTRA: "Sample",
    OBSEQUIO: "Gift",
  },
  es: {
    NORMAL: "Nuevo",
    COMPLETACION: "Completacion",
    REFERENTE: "Referente",
    REPOSICION: "Reposicion",
    MUESTRA: "Muestra",
    OBSEQUIO: "Obsequio",
  },
};

const PROCESS_LABELS: Record<UiLocale, Record<QuoteProcess, string>> = {
  en: {
    PRODUCCION: "Production",
    BODEGA: "Warehouse",
    COMPRAS: "Purchases",
  },
  es: {
    PRODUCCION: "Produccion",
    BODEGA: "Bodega",
    COMPRAS: "Compras",
  },
};

const PREFACTURE_ORDER_TYPE_LABELS: Record<
  UiLocale,
  Record<PrefactureOrderType, string>
> = {
  en: {
    VN: "VN - National",
    VI: "VI - International",
    VT: "VT",
    VW: "VW",
  },
  es: {
    VN: "VN - Nacional",
    VI: "VI - Internacional",
    VT: "VT",
    VW: "VW",
  },
};

export function getClientPriceTypeOptions(
  locale: UiLocale,
): Option<ClientPriceType>[] {
  const labels = CLIENT_PRICE_TYPE_LABELS[locale];

  return [
    { value: "AUTORIZADO", label: labels.AUTORIZADO },
    { value: "MAYORISTA", label: labels.MAYORISTA },
    { value: "VIOMAR", label: labels.VIOMAR },
    { value: "COLANTA", label: labels.COLANTA },
  ];
}

export function getPaymentTermOptions(
  locale: UiLocale,
): Option<PaymentTerm>[] {
  const labels = PAYMENT_TERM_LABELS[locale];

  return [
    { value: "TRANSFERENCIA", label: labels.TRANSFERENCIA },
    { value: "EFECTIVO", label: labels.EFECTIVO },
    { value: "TARJETA", label: labels.TARJETA },
    { value: "CHEQUE", label: labels.CHEQUE },
    { value: "CREDITO", label: labels.CREDITO },
    { value: "OTROS", label: labels.OTROS },
  ];
}

export function getOrderTypeOptions(locale: UiLocale): Option<OrderType>[] {
  const labels = ORDER_TYPE_LABELS[locale];

  return [
    { value: "NORMAL", label: labels.NORMAL },
    { value: "COMPLETACION", label: labels.COMPLETACION },
    { value: "REFERENTE", label: labels.REFERENTE },
    { value: "REPOSICION", label: labels.REPOSICION },
    { value: "MUESTRA", label: labels.MUESTRA },
    { value: "OBSEQUIO", label: labels.OBSEQUIO },
  ];
}

export function getProcessOptions(
  locale: UiLocale,
): Option<QuoteProcess>[] {
  const labels = PROCESS_LABELS[locale];

  return [
    { value: "PRODUCCION", label: labels.PRODUCCION },
    { value: "BODEGA", label: labels.BODEGA },
    { value: "COMPRAS", label: labels.COMPRAS },
  ];
}

export function getPrefactureOrderTypeOptions(
  locale: UiLocale,
): Option<PrefactureOrderType>[] {
  const labels = PREFACTURE_ORDER_TYPE_LABELS[locale];

  return [
    { value: "VN", label: labels.VN },
    { value: "VI", label: labels.VI },
    { value: "VT", label: labels.VT },
    { value: "VW", label: labels.VW },
  ];
}

export const QUOTATION_COPY: Record<
  UiLocale,
  {
    form: {
      clientCode: string;
      documentType: string;
      email: string;
      documentNumber: string;
      verificationDigit: string;
      contactName: string;
      contactPhone: string;
      address: string;
      country: string;
      city: string;
      postalCode: string;
      seller: string;
      clientType: string;
      currency: string;
      expirationDate: string;
      paymentTerms: string;
      promissoryNote: string;
      activeCreditError: string;
      promissoryError: string;
    };
    editor: {
      titleEdit: string;
      titleCreate: string;
      titleCreatePrefacture: string;
      code: string;
      directPrefactureNote: string;
      back: string;
      orderName: string;
      orderNamePlaceholder: string;
      orderType: string;
      clientApproval: string;
      clientApprovalHelp: string;
      approvalEvidence: string;
      generalInformation: string;
      totals: string;
      subtotal: string;
      vat: string;
      shipping: string;
      shippingValue: string;
      insurance: string;
      insuranceValue: string;
      advance: string;
      advanceHelp: string;
      advanceAmount: string;
      notApplicable: string;
      generalTotal: string;
      withholdings: string;
      withholdingTax: string;
      withholdingIca: string;
      withholdingIva: string;
      noTaxesForR: string;
      fiscalSnapshot: string;
      noMunicipality: string;
      withholdingTaxValue: string;
      withholdingIcaValue: string;
      withholdingIvaValue: string;
      totalWithholdings: string;
      totalAfterWithholdings: string;
      saveChanges: string;
      saveQuotation: string;
      savePrefacture: string;
      saving: string;
      validation: {
        noCredit: string;
        noPromissory: string;
        approvalEvidenceRequired: string;
        prefactureCreated: string;
      };
    };
    products: {
      title: string;
      addProduct: string;
      summaryTitle: string;
      empty: string;
      unselectedProduct: string;
      headers: {
        index: string;
        product: string;
        process: string;
        quantity: string;
        designTotal: string;
        additions: string;
        itemTotal: string;
        actions: string;
      };
      edit: string;
      remove: string;
      editProduct: string;
      editProductNumber: (index: number) => string;
      designType: string;
      process: string;
      productSearch: string;
      description: string;
      quantity: string;
      unitPrice: string;
      discount: string;
      totalValue: string;
      discountPlaceholder: string;
    };
    additions: {
      titleForProduct: (product: string) => string;
      addAddition: string;
      conditionalReferenceSection: string;
      searchOrderByCode: string;
      searchOrderPlaceholder: string;
      referenceOrder: string;
      referenceDesign: string;
      noClient: string;
      orderPreview: string;
      designPreview: string;
      selectOrderSummary: string;
      selectDesignPreview: string;
      orderCode: string;
      client: string;
      type: string;
      status: string;
      designs: string;
      number: string;
      name: string;
      quantity: string;
      empty: string;
      addition: string;
      selectProduct: string;
      qty: string;
      valuePlaceholder: (currency: string) => string;
      remove: string;
    };
    list: {
      empty: string;
      search: string;
      searchPlaceholder: string;
      currency: string;
      status: string;
      refresh: string;
      createQuotation: string;
      headers: {
        code: string;
        client: string;
        seller: string;
        expiration: string;
        currency: string;
        total: string;
        status: string;
        actions: string;
      };
      active: string;
      inactive: string;
      all: string;
      actionsAriaLabel: string;
      actionViewEdit: string;
      actionEdit: string;
      actionDownloadPdf: string;
      actionDownloadingPdf: string;
      actionDownloadExcel: string;
      actionDownloadingExcel: string;
      actionApprovePrefacture: string;
      actionRevertPrefacture: string;
      actionConverting: string;
      actionDelete: string;
      total: (count: number) => string;
      previous: string;
      next: string;
      deleteTitle: string;
      deleteDescription: (code: string) => string;
      deleteSuccess: string;
      downloadTitle: string;
      downloadDescription: string;
      cancel: string;
      internalPdf: string;
      externalPdf: string;
      prefactureModalApprove: string;
      prefactureModalRevert: string;
      confirm: string;
      prefactureUpdated: (code: string) => string;
      prefactureCreated: (code: string) => string;
    };
    toasts: {
      selectClient: string;
      sellerNotFound: string;
      addValidItem: string;
      quotationUpdated: (quoteCode: string) => string;
      quotationCreated: (quoteCode: string) => string;
    };
  }
> = {
  en: {
    form: {
      clientCode: "Client code",
      documentType: "Document type",
      email: "Email",
      documentNumber: "NIT / CC",
      verificationDigit: "DV",
      contactName: "Contact name",
      contactPhone: "Contact phone",
      address: "Address",
      country: "Country",
      city: "City",
      postalCode: "Postal code",
      seller: "Seller",
      clientType: "Client type (COP)",
      currency: "Currency",
      expirationDate: "Expiration date",
      paymentTerms: "Payment terms",
      promissoryNote: "Promissory note number",
      activeCreditError:
        "Client has no active credit. Cannot save with credit payment.",
      promissoryError:
        "Client has no promissory note number. Cannot save with credit payment.",
    },
    editor: {
      titleEdit: "Edit quotation",
      titleCreate: "Create quotation",
      titleCreatePrefacture: "Create prefacture",
      code: "Code",
      directPrefactureNote: "(will be created as direct prefacture)",
      back: "Back",
      orderName: "Order name",
      orderNamePlaceholder: "E.g: Order Sports Club",
      orderType: "Order type",
      clientApproval: "Client approval",
      clientApprovalHelp: "Client commercial confirmation.",
      approvalEvidence: "Screenshot / approval evidence",
      generalInformation: "General information",
      totals: "Totals",
      subtotal: "Subtotal",
      vat: "VAT (19%)",
      shipping: "Shipping",
      shippingValue: "Shipping value",
      insurance: "Insurance",
      insuranceValue: "Insurance value",
      advance: "Advance",
      advanceHelp: "Commercial control at 50% for the prefacture.",
      advanceAmount: "Advance (50%)",
      notApplicable: "Not applicable",
      generalTotal: "General total",
      withholdings: "Withholdings",
      withholdingTax: "Withholding tax (%)",
      withholdingIca: "ICA withholding (%)",
      withholdingIva: "VAT withholding (%)",
      noTaxesForR:
        "With document type R, VAT and withholdings are not charged.",
      fiscalSnapshot: "Fiscal snapshot",
      noMunicipality: "No municipality",
      withholdingTaxValue: "Withholding value",
      withholdingIcaValue: "ICA withholding value",
      withholdingIvaValue: "VAT withholding value",
      totalWithholdings: "Total withholdings",
      totalAfterWithholdings: "Total after withholdings",
      saveChanges: "Save changes",
      saveQuotation: "Save quotation",
      savePrefacture: "Save prefacture",
      saving: "Saving...",
      validation: {
        noCredit: "The client has no active credit.",
        noPromissory:
          "The client has no promissory note number registered.",
        approvalEvidenceRequired:
          "You must attach the screenshot/evidence of the client's approval.",
        prefactureCreated: "Prefacture created",
      },
    },
    products: {
      title: "Product details",
      addProduct: "Add product",
      summaryTitle: "Products summary table",
      empty: "No products added yet.",
      unselectedProduct: "No product selected",
      headers: {
        index: "#",
        product: "Product",
        process: "Process",
        quantity: "Qty.",
        designTotal: "Design total",
        additions: "Additions",
        itemTotal: "Item total",
        actions: "Actions",
      },
      edit: "Edit",
      remove: "Remove",
      editProduct: "Edit product",
      editProductNumber: (index: number) => `Edit product #${index}`,
      designType: "Design type",
      process: "Process",
      productSearch: "Product (search by code)",
      description: "Description",
      quantity: "Quantity",
      unitPrice: "Unit price",
      discount: "Discount %",
      totalValue: "Total value",
      discountPlaceholder: "0",
    },
    additions: {
      titleForProduct: (product: string) => `Additions for ${product}`,
      addAddition: "Add addition",
      conditionalReferenceSection: "Conditional reference",
      searchOrderByCode: "Search order by code",
      searchOrderPlaceholder: "E.g: ORD-001",
      referenceOrder: "Reference order",
      referenceDesign: "Reference design",
      noClient: "No client",
      orderPreview: "Order preview",
      designPreview: "Design preview",
      selectOrderSummary: "Select an order to see its summary.",
      selectDesignPreview: "Select a design to see preview.",
      orderCode: "Code",
      client: "Client",
      type: "Type",
      status: "Status",
      designs: "Designs",
      number: "Number",
      name: "Name",
      quantity: "Quantity",
      empty: "No additions for this product",
      addition: "Addition",
      selectProduct: "Select product",
      qty: "Qty",
      valuePlaceholder: (currency: string) => `Value (${currency})`,
      remove: "Remove",
    },
    list: {
      empty: "No quotations",
      search: "Search",
      searchPlaceholder: "Code, client or seller",
      currency: "Currency",
      status: "Status",
      refresh: "Refresh",
      createQuotation: "Create quotation",
      headers: {
        code: "Code",
        client: "Client",
        seller: "Seller",
        expiration: "Expiration",
        currency: "Currency",
        total: "Total",
        status: "Status",
        actions: "Actions",
      },
      active: "Active",
      inactive: "Inactive",
      all: "All",
      actionsAriaLabel: "Quotation actions",
      actionViewEdit: "View / Edit",
      actionEdit: "Edit",
      actionDownloadPdf: "Download PDF",
      actionDownloadingPdf: "Downloading PDF...",
      actionDownloadExcel: "Download Excel",
      actionDownloadingExcel: "Downloading Excel...",
      actionApprovePrefacture: "Approve prefacture",
      actionRevertPrefacture: "Revert prefacture",
      actionConverting: "Converting...",
      actionDelete: "Delete",
      total: (count: number) => `Total: ${count}`,
      previous: "Previous",
      next: "Next",
      deleteTitle: "Confirm deletion",
      deleteDescription: (code: string) => `Delete quotation ${code}?`,
      deleteSuccess: "Quotation deleted",
      downloadTitle: "Download quotation PDF",
      downloadDescription: "Choose the PDF format: internal or external.",
      cancel: "Cancel",
      internalPdf: "Internal PDF",
      externalPdf: "External PDF",
      prefactureModalApprove: "Approve prefacture",
      prefactureModalRevert: "Revert prefacture",
      confirm: "Confirm",
      prefactureUpdated: (code: string) => `Prefacture updated. Order: ${code}`,
      prefactureCreated: (code: string) => `Prefacture created. Order: ${code}`,
    },
    toasts: {
      selectClient: "Select an active client",
      sellerNotFound: "Seller from session not found. Reload the page.",
      addValidItem: "Add at least one valid item",
      quotationUpdated: (quoteCode: string) => `Quotation updated: ${quoteCode}`,
      quotationCreated: (quoteCode: string) => `Quotation created: ${quoteCode}`,
    },
  },
  es: {
    form: {
      clientCode: "Codigo de cliente",
      documentType: "Tipo de documento",
      email: "Correo",
      documentNumber: "NIT / CC",
      verificationDigit: "DV",
      contactName: "Nombre de contacto",
      contactPhone: "Telefono de contacto",
      address: "Direccion",
      country: "Pais",
      city: "Ciudad",
      postalCode: "Codigo postal",
      seller: "Vendedor",
      clientType: "Tipo de cliente (COP)",
      currency: "Moneda",
      expirationDate: "Fecha de vencimiento",
      paymentTerms: "Forma de pago",
      promissoryNote: "Numero de pagare",
      activeCreditError:
        "El cliente no tiene credito activo. No se puede guardar con pago a credito.",
      promissoryError:
        "El cliente no tiene numero de pagare. No se puede guardar con pago a credito.",
    },
    editor: {
      titleEdit: "Editar cotizacion",
      titleCreate: "Crear cotizacion",
      titleCreatePrefacture: "Crear prefactura",
      code: "Codigo",
      directPrefactureNote: "(se creara como prefactura directa)",
      back: "Volver",
      orderName: "Nombre del pedido",
      orderNamePlaceholder: "Ej: Pedido Club Deportivo",
      orderType: "Tipo de pedido",
      clientApproval: "Aprobacion del cliente",
      clientApprovalHelp: "Confirmacion comercial del cliente.",
      approvalEvidence: "Captura / evidencia de aprobacion",
      generalInformation: "Informacion general",
      totals: "Totales",
      subtotal: "Subtotal",
      vat: "IVA (19%)",
      shipping: "Envio",
      shippingValue: "Valor del envio",
      insurance: "Seguro",
      insuranceValue: "Valor del seguro",
      advance: "Anticipo",
      advanceHelp: "Control comercial al 50% para la prefactura.",
      advanceAmount: "Anticipo (50%)",
      notApplicable: "No aplica",
      generalTotal: "Total general",
      withholdings: "Retenciones",
      withholdingTax: "Retefuente (%)",
      withholdingIca: "ReteICA (%)",
      withholdingIva: "ReteIVA (%)",
      noTaxesForR:
        "Con documento tipo R no se cobra IVA ni retenciones.",
      fiscalSnapshot: "Snapshot fiscal",
      noMunicipality: "Sin municipio",
      withholdingTaxValue: "Valor retefuente",
      withholdingIcaValue: "Valor reteICA",
      withholdingIvaValue: "Valor reteIVA",
      totalWithholdings: "Total retenciones",
      totalAfterWithholdings: "Total despues de retenciones",
      saveChanges: "Guardar cambios",
      saveQuotation: "Guardar cotizacion",
      savePrefacture: "Guardar prefactura",
      saving: "Guardando...",
      validation: {
        noCredit: "El cliente no tiene credito activo.",
        noPromissory: "El cliente no tiene numero de pagare registrado.",
        approvalEvidenceRequired:
          "Debes adjuntar la captura o evidencia de aprobacion del cliente.",
        prefactureCreated: "Prefactura creada",
      },
    },
    products: {
      title: "Detalle de productos",
      addProduct: "Agregar producto",
      summaryTitle: "Tabla resumen de productos",
      empty: "No hay productos agregados.",
      unselectedProduct: "Producto sin seleccionar",
      headers: {
        index: "#",
        product: "Producto",
        process: "Proceso",
        quantity: "Cant.",
        designTotal: "Total diseno",
        additions: "Adiciones",
        itemTotal: "Total item",
        actions: "Acciones",
      },
      edit: "Editar",
      remove: "Quitar",
      editProduct: "Editar producto",
      editProductNumber: (index: number) => `Editar producto #${index}`,
      designType: "Tipo de diseno",
      process: "Proceso",
      productSearch: "Producto (buscar por codigo)",
      description: "Descripcion",
      quantity: "Cantidad",
      unitPrice: "Valor unitario",
      discount: "Descuento %",
      totalValue: "Valor total",
      discountPlaceholder: "0",
    },
    additions: {
      titleForProduct: (product: string) => `Adiciones para ${product}`,
      addAddition: "Agregar adicion",
      conditionalReferenceSection: "Referencia condicional",
      searchOrderByCode: "Buscar pedido por codigo",
      searchOrderPlaceholder: "Ej: ORD-001",
      referenceOrder: "Pedido de referencia",
      referenceDesign: "Diseno de referencia",
      noClient: "Sin cliente",
      orderPreview: "Vista previa del pedido",
      designPreview: "Vista previa del diseno",
      selectOrderSummary: "Selecciona un pedido para ver su resumen.",
      selectDesignPreview: "Selecciona un diseno para ver la vista previa.",
      orderCode: "Codigo",
      client: "Cliente",
      type: "Tipo",
      status: "Estado",
      designs: "Disenos",
      number: "Numero",
      name: "Nombre",
      quantity: "Cantidad",
      empty: "No hay adiciones para este producto",
      addition: "Adicion",
      selectProduct: "Selecciona un producto",
      qty: "Cant.",
      valuePlaceholder: (currency: string) => `Valor (${currency})`,
      remove: "Quitar",
    },
    list: {
      empty: "Sin cotizaciones",
      search: "Buscar",
      searchPlaceholder: "Codigo, cliente o vendedor",
      currency: "Moneda",
      status: "Estado",
      refresh: "Actualizar",
      createQuotation: "Crear cotizacion",
      headers: {
        code: "Codigo",
        client: "Cliente",
        seller: "Vendedor",
        expiration: "Vencimiento",
        currency: "Moneda",
        total: "Total",
        status: "Estado",
        actions: "Acciones",
      },
      active: "Activo",
      inactive: "Inactivo",
      all: "Todos",
      actionsAriaLabel: "Acciones de cotizacion",
      actionViewEdit: "Ver / editar",
      actionEdit: "Editar",
      actionDownloadPdf: "Descargar PDF",
      actionDownloadingPdf: "Descargando PDF...",
      actionDownloadExcel: "Descargar Excel",
      actionDownloadingExcel: "Descargando Excel...",
      actionApprovePrefacture: "Aprobar prefactura",
      actionRevertPrefacture: "Revertir prefactura",
      actionConverting: "Convirtiendo...",
      actionDelete: "Eliminar",
      total: (count: number) => `Total: ${count}`,
      previous: "Anterior",
      next: "Siguiente",
      deleteTitle: "Confirmar eliminacion",
      deleteDescription: (code: string) => `Eliminar cotizacion ${code}?`,
      deleteSuccess: "Cotizacion eliminada",
      downloadTitle: "Descargar PDF de cotizacion",
      downloadDescription: "Elige el formato del PDF: interno o externo.",
      cancel: "Cancelar",
      internalPdf: "PDF interno",
      externalPdf: "PDF externo",
      prefactureModalApprove: "Aprobar prefactura",
      prefactureModalRevert: "Revertir prefactura",
      confirm: "Confirmar",
      prefactureUpdated: (code: string) => `Prefactura actualizada. Pedido: ${code}`,
      prefactureCreated: (code: string) => `Prefactura creada. Pedido: ${code}`,
    },
    toasts: {
      selectClient: "Selecciona un cliente activo",
      sellerNotFound: "No se encontro el vendedor en sesion. Recarga la pagina.",
      addValidItem: "Agrega al menos un item valido",
      quotationUpdated: (quoteCode: string) => `Cotizacion actualizada: ${quoteCode}`,
      quotationCreated: (quoteCode: string) => `Cotizacion creada: ${quoteCode}`,
    },
  },
};