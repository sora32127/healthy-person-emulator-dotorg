import ThemeSwitcher from './ThemeSwitcher';
import TextTypeSwitcher from './TextTypeSwitcher';
import ClearLocalStorageButton from './ClearLocalStorageButton';
import Container from 'react-bootstrap/Container';
import { Navbar, Nav } from 'react-bootstrap';
import styled from 'styled-components';

const StyledNavbar = styled(Navbar)`
  @media (max-width: 576px) {
    .navbar-brand {
      display: none;
    }
    .navbar-nav {
      flex-direction: row;
      align-items: center;
    }
    .nav-item {
      margin-right: 1rem;
      display: flex;
      align-items: center;
    }
    .nav-item.theme-switcher {
      margin-right: 1.5rem;
    }
  }
`;

interface TopbarProps {
  onToggle: (selectedType: string) => void;
  clearInputs: () => void;
}

const TopBar: React.FC<TopbarProps> = ({ onToggle, clearInputs }) => {
  return (
    <StyledNavbar fixed="top" data-bs-theme="dark">
      <Container fluid>
        <Navbar.Brand>3.0.0</Navbar.Brand>
        <Navbar.Collapse className="justify-content-end">
          <Nav className="ml-auto align-items-center">
            <Nav.Item className="mr-3 theme-switcher">
              <ThemeSwitcher />
            </Nav.Item>
            <Nav.Item className="mr-3">
              <ClearLocalStorageButton clearInputs={clearInputs} />
            </Nav.Item>
            <Nav.Item>
              <TextTypeSwitcher onToggle={onToggle} />
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </StyledNavbar>
  );
};

export default TopBar;