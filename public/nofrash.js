// This will help to prevent a flash according to theme change.

;(() => {
    const storageKey = 'theme'
    const classNameDark = 'dark'
    const classNameLight = 'light'
  
    function setClassOnDocumentBody(className) {
      const html = document.getElementsByTagName('html')[0]
      html.setAttribute('data-theme', className)
    }
  
    let localStorageTheme = null
    try {
      localStorageTheme = JSON.parse(localStorage.getItem(storageKey))
    } catch (err) {}
    const localStorageExists = localStorageTheme !== null
  
    if (localStorageExists) {
      if (localStorageTheme === classNameDark) {
        setClassOnDocumentBody(classNameDark)
      }
      if (localStorageTheme === classNameLight) {
        setClassOnDocumentBody(classNameLight)
      }
    }
  })()