export function rowDir(isRTL: boolean) {
  return {flexDirection: isRTL ? ('row-reverse' as const) : ('row' as const)};
}

export function textDir(isRTL: boolean) {
  return {
    textAlign: isRTL ? ('right' as const) : ('left' as const),
    writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const)
  };
}
