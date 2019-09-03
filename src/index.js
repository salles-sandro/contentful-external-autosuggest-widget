import '@contentful/forma-36-react-components/dist/styles.css'
import './index.css'
import 'whatwg-fetch'

import { Spinner, TextInput } from '@contentful/forma-36-react-components'

import $ from 'jquery'
import Autosuggest from 'react-autosuggest'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PropTypes from 'prop-types'
import React from 'react'
import ReactDOM from 'react-dom'
import ReactTooltip from 'react-tooltip'
import _ from 'lodash'
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons'
import { init } from 'contentful-ui-extensions-sdk'
import parse from 'html-react-parser'

const getSuggestionValue = (suggestion) => suggestion.identifier
const renderInputComponent = (inputProps) => <TextInput {...inputProps} />

export class App extends React.Component {
  static propTypes = {
    sdk: PropTypes.object.isRequired
  }

  detachExternalChangeHandler = null
  abortController = new AbortController()

  constructor (props) {
    super(props)
    this.state = {
      value:
        props.sdk.field.getValue() ||
        props.sdk.parameters.instance.default_value,
      error: false,
      warning: false,
      hasLoaded: false,
      available: [],
      filtered: []
    }

    this.renderSuggestion = this.renderSuggestion.bind(this)
  }

  renderSuggestion (suggestion) {
    const selected =
      suggestion.identifier === this.state.value ? 'selected' : ''

    return (
      <div className={`suggestion-container ${selected}`}>
        {!_.isEmpty(selected) && <FontAwesomeIcon icon={faCheckCircle} />}
        <div className='suggestion-preview' data-tip={suggestion.identifier}>
          {parse(suggestion.preview)}
        </div>
        <ReactTooltip />
      </div>
    )
  }

  componentDidMount () {
    this.props.sdk.window.startAutoResizer()

    // Handler for external field value changes (e.g. when multiple authors are working on the same entry).
    this.detachExternalChangeHandler = this.props.sdk.field.onValueChanged(
      this.onExternalChange
    )

    let api_url = this.props.sdk.parameters.instance.api_url

    if (api_url.includes('localhost')) {
      api_url = api_url.replace('https', 'http')
    }

    fetch(api_url, { signal: this.abortController.signal, mode: 'no-cors' })
      .then((res) => res.json())
      .then(
        (available) => {
          let state = {
            hasLoaded: true,
            available
          }

          if (
            this.props.sdk.parameters.instance.default_value &&
            !_.find(available, {
              identifier: this.props.sdk.parameters.instance.default_value
            })
          ) {
            state.warning = `The provided default value (${
              this.props.sdk.parameters.instance.default_value
            }) is not valid`
          }

          this.setState(state)
        },
        (error) => {
          this.setState({
            hasLoaded: true,
            error: error
          })
        }
      )
  }

  componentWillUnmount () {
    if (this.detachExternalChangeHandler) {
      this.detachExternalChangeHandler()
    }
    this.abortController.abort()
  }

  onExternalChange = (value) => {
    this.setState({ value })
  }

  // Autosuggest will call this function every time you need to update suggestions.
  // You already implemented this logic above, so just use it.
  onSuggestionsFetchRequested = ({ value }) => {
    this.setState({
      filtered: this.state.available.filter((suggestion) => {
        return suggestion.identifier.includes(value)
      })
    })
  }

  // Autosuggest will call this function every time you need to clear suggestions.
  onSuggestionsClearRequested = () => {
    this.props.sdk.field.setInvalid(false)

    this.setState({
      filtered: []
    })
  }

  onChange = (e, { newValue }) => {
    $('.suggestion-container').removeClass('selected')
    $(e.target)
      .parents('.suggestion-container:first')
      .addClass('selected')

    const value = newValue
    const default_value = this.props.sdk.parameters.instance.default_value

    if (value) {
      if (!_.find(this.state.available, { identifier: value })) {
        this.props.sdk.field.setInvalid(true)
      } else {
        this.setState({ value })
        this.props.sdk.field.setValue(value)
        this.props.sdk.field.setInvalid(false)
      }
    } else if (default_value) {
      this.setState({ value: default_value })
      this.props.sdk.field.setValue(default_value)
    }
  }

  render () {
    if (!this.state.hasLoaded) {
      return <Spinner />
    }

    if (this.state.error) {
      return (
        <div className='error'>
          There was an error while trying to fetch autocomplete options from
          {this.props.sdk.parameters.instance.api_url}. Please check if the
          endpoint URL is up and running and try again
        </div>
      )
    }

    const { value, available } = this.state
    const inputProps = {
      placeholder: 'Type a programming language',
      value: value || '',
      onChange: this.onChange
    }

    return (
      <div
        className={`autosuggest-container ${
          this.props.sdk.parameters.instance.display_mode
        }`}
      >
        <Autosuggest
          alwaysRenderSuggestions
          focusInputOnSuggestionClick={false}
          suggestions={available}
          onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          onSuggestionsClearRequested={this.onSuggestionsClearRequested}
          getSuggestionValue={getSuggestionValue}
          renderSuggestion={this.renderSuggestion}
          renderInputComponent={renderInputComponent}
          inputProps={inputProps}
        />

        {this.state.warning && (
          <div className='warning'>{this.state.wargning}</div>
        )}
      </div>
    )
  }
}

init((sdk) => {
  ReactDOM.render(<App sdk={sdk} />, document.getElementById('root'))
})

/**
 * By default, iframe of the extension is fully reloaded on every save of a source file.
 * If you want to use HMR (hot module reload) instead of full reload, uncomment the following lines
 */
if (module.hot) {
  module.hot.accept()
}
